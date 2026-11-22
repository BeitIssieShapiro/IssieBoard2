require 'minitest/autorun'
require 'tmpdir'
require 'fileutils'
require 'dotenv'
require 'shellwords'
require 'xcodeproj'

# Run the real lane definitions with build, signing and upload actions replaced
# by recording stubs. Each test uses a temporary copy of the Xcode project.
class DeploymentHarness
  # Set by the test: the temporary project root the lanes run against
  ROOT_FOR_TESTS = -> { Thread.current[:deploy_test_root] }

  class UI
    def self.user_error!(message) = raise(ArgumentError, message)
    def self.message(*) = nil
    def self.success(*) = nil
  end

  module SharedValues
    SIGH_NAME = :profile_name
  end

  class << self
    attr_reader :lanes
    def default_platform(*) = nil
    def desc(*) = nil
    def platform(*) = yield
    def lane(name, &block)
      (@lanes ||= {})[name] = block
    end
  end

  attr_accessor :fail_build, :latest_build
  attr_reader :calls

  def initialize
    @calls = []
    @latest_build = 7
    @context = {}
  end

  def run(lane, options = {})
    instance_exec(options, &self.class.lanes.fetch(lane))
  end

  def lane_context = @context

  def calls_to(name) = @calls.select { |call, _| call == name }.map(&:last)

  def method_missing(name, *args, **options)
    @calls << [name, options]
    case name
    when :app_store_connect_api_key then { key_id: 'test-key' }
    when :latest_testflight_build_number then @latest_build
    when :get_provisioning_profile
      @context[SharedValues::SIGH_NAME] = "#{options.fetch(:app_identifier)} AppStore"
      nil
    when :update_code_signing_settings
      File.write(File.join(options.fetch(:path), 'project.pbxproj'), 'temporary signing configuration')
    when :build_app
      raise 'Archive failed' if @fail_build
      "/tmp/#{options.fetch(:output_name)}"
    when :cocoapods
      # pod install reformats the project file
      File.write(File.join(ROOT_FOR_TESTS.call, 'ios/IssieBoardNG.xcodeproj/project.pbxproj'), 'reformatted by pod install')
      nil
    when :get_certificates, :upload_to_testflight, :sh
      nil
    else
      super
    end
  end

  def respond_to_missing?(*args) = true
end

class IOSDeploymentTest < Minitest::Test
  ROOT = File.expand_path('../../..', __dir__)
  ENV_KEYS = %w[ASC_KEY_ID ASC_ISSUER_ID ASC_KEY_PATH APPLE_TEAM_ID IOS_VERSION].freeze

  def setup
    @environment = ENV_KEYS.to_h { |key| [key, ENV[key]] }
    @directory = Dir.mktmpdir('issie-ios-deploy-')
    project = File.join(@directory, 'ios/IssieBoardNG.xcodeproj')
    FileUtils.mkdir_p(project)
    FileUtils.mkdir_p(File.join(@directory, 'node_modules'))
    @project_file = File.join(project, 'project.pbxproj')
    FileUtils.cp(File.join(ROOT, 'ios/IssieBoardNG.xcodeproj/project.pbxproj'), @project_file)
    @original_project = File.binread(@project_file)
    key_path = File.join(@directory, 'test.p8')
    File.write(key_path, 'test fixture')
    ENV.update('ASC_KEY_ID' => 'test-key', 'ASC_ISSUER_ID' => 'test-issuer',
               'ASC_KEY_PATH' => key_path, 'APPLE_TEAM_ID' => 'SKNJT9TD9G')
    ENV.delete('IOS_VERSION')
    source = File.read(File.join(ROOT, 'ios/fastlane/Fastfile'))
    source = source.sub(/^ROOT = .*$/, "ROOT = #{@directory.dump}")
    harness_class = Class.new(DeploymentHarness)
    harness_class.class_eval(source, File.join(ROOT, 'ios/fastlane/Fastfile'))
    @runner = harness_class.new
    Thread.current[:deploy_test_root] = @directory
  end

  # The app's own Release version, so the tests survive version bumps
  def release_version(target)
    project = Xcodeproj::Project.open(File.join(ROOT, 'ios/IssieBoardNG.xcodeproj'))
    release = project.targets.find { |t| t.name == target }.build_configurations.find { |c| c.name == 'Release' }
    release.build_settings.fetch('MARKETING_VERSION')
  end

  def teardown
    @environment.each { |key, value| value ? ENV[key] = value : ENV.delete(key) }
    FileUtils.remove_entry(@directory)
  end

  def test_uploads_all_three_apps_by_default
    @runner.run(:beta)
    assert_equal %w[IssieBoardNG IssieVoice IssieCalc], @runner.calls_to(:build_app).map { |b| b[:scheme] }
    assert_equal %w[com.issieshapiro.Issieboard org.issieshapiro.IssieVoice com.issieshapiro.IssieCalc],
                 @runner.calls_to(:upload_to_testflight).map { |u| u[:app_identifier] }
    assert_equal 1, @runner.calls_to(:get_certificates).size
    assert_equal @original_project, File.binread(@project_file)
  end

  def test_issieboard_signs_its_keyboard_extensions
    @runner.run(:beta, app: 'issieboard')
    profiles = @runner.calls_to(:get_provisioning_profile).map { |p| p[:app_identifier] }
    assert_equal %w[com.issieshapiro.Issieboard com.issieshapiro.Issieboard.IssieBoardEn
                    com.issieshapiro.Issieboard.IssieBoardHe com.issieshapiro.Issieboard.IssieBoardAr], profiles
    assert_equal %w[IssieBoard IssieBoardEn IssieBoardHe IssieBoardAr],
                 @runner.calls_to(:update_code_signing_settings).flat_map { |s| s[:targets] }
    build = @runner.calls_to(:build_app).first
    assert_equal profiles.to_h { |id| [id, "#{id} AppStore"] }, build[:export_options][:provisioningProfiles]
    # Version and build number on the command line, so the extensions match the app
    assert_includes Shellwords.split(build[:xcargs]), "MARKETING_VERSION=#{release_version('IssieBoard')}"
    assert_includes Shellwords.split(build[:xcargs]), 'CURRENT_PROJECT_VERSION=28'
  end

  def test_one_app_uses_its_own_version_and_the_next_remote_build
    @runner.run(:beta, app: 'issievoice')
    build = @runner.calls_to(:build_app).first
    assert_equal 'IssieVoice', build[:scheme]
    assert_equal 'Release', build[:configuration]
    assert_includes Shellwords.split(build[:xcargs]), "MARKETING_VERSION=#{release_version('IssieVoice')}"
    assert_includes Shellwords.split(build[:xcargs]), 'CURRENT_PROJECT_VERSION=8'
    upload = @runner.calls_to(:upload_to_testflight).first
    assert_equal '/tmp/IssieVoice.ipa', upload[:ipa]
    assert_equal ['org.issieshapiro.IssieVoice'], @runner.calls_to(:get_provisioning_profile).map { |p| p[:app_identifier] }
  end

  def test_archive_failure_restores_signing_and_stops_before_upload
    @runner.fail_build = true
    error = assert_raises(RuntimeError) { @runner.run(:beta, app: 'issieboard') }
    assert_equal 'Archive failed', error.message
    assert_equal @original_project, File.binread(@project_file)
    assert_empty @runner.calls_to(:upload_to_testflight)
  end

  def test_missing_credentials_stop_before_any_apple_actions
    ENV['ASC_ISSUER_ID'] = ''
    assert_raises(ArgumentError) { @runner.run(:beta) }
    assert_empty @runner.calls
  end

  def test_unknown_app_stops_before_any_apple_actions
    assert_raises(ArgumentError) { @runner.run(:beta, app: 'issiedice') }
    assert_empty @runner.calls
  end

  def test_version_override_needs_a_single_app
    ENV['IOS_VERSION'] = '2.2'
    assert_raises(ArgumentError) { @runner.run(:beta) }
    assert_empty @runner.calls
  end

  def test_invalid_version_stops_before_any_apple_actions
    ENV['IOS_VERSION'] = 'invalid version'
    assert_raises(ArgumentError) { @runner.run(:beta, app: 'issiecalc') }
    assert_empty @runner.calls
  end

  def test_marketing_version_override_and_local_build_floor
    ENV['IOS_VERSION'] = '2.2'
    @runner.latest_build = 0
    @runner.run(:beta, app: 'issieboard')
    build = @runner.calls_to(:build_app).first
    assert_includes Shellwords.split(build[:xcargs]), 'MARKETING_VERSION=2.2'
    assert_includes Shellwords.split(build[:xcargs]), 'CURRENT_PROJECT_VERSION=28'
  end

  def test_build_number_counts_the_short_version_and_the_latest_overall
    @runner.run(:beta, app: 'issievoice')
    versions = @runner.calls_to(:latest_testflight_build_number).map { |c| c[:version] }
    version = release_version('IssieVoice')
    assert_equal [version, version.sub(/(\.0)+\z/, ''), nil].uniq, versions
  end

  def test_check_only_reads_apple_build_information
    @runner.run(:check)
    assert_equal %w[IssieBoard IssieVoice IssieCalc].size, @runner.calls_to(:latest_testflight_build_number).map { |c| c[:app_identifier] }.uniq.size
    assert_empty @runner.calls_to(:get_certificates)
    assert_empty @runner.calls_to(:build_app)
    assert_empty @runner.calls_to(:upload_to_testflight)
  end
end
