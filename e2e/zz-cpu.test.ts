import { by, device, element, waitFor } from 'detox';
import { execSync } from 'child_process';
import { launch, sleep, tapIdWhenFree } from './helpers';
function cpu(label: string) {
  const samples: number[] = [];
  for (let i = 0; i < 10; i++) {
    const out = execSync(`ps -Ao %cpu,comm | grep -E 'IssieBoardNG.app/IssieBoardNG$' | grep -v grep || true`).toString().trim();
    samples.push(parseFloat(out.split(/\s+/)[0] || '0'));
    execSync('sleep 1');
  }
  console.log('CPU', label, samples.join(' '), 'avg', (samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(1));
}
describe('cpu', () => {
  it('suggestions on/off', async () => {
    await launch(); await device.disableSynchronization();
    await waitFor(element(by.id('editor-lang-en')).atIndex(0)).toExist().withTimeout(20000);
    // Dismiss any iOS system popover that may appear at startup (e.g. from UIViewControllerBasedStatusBarAppearance)
    try {
      await element(by.id('PopoverDismissRegion')).atIndex(0).tap();
      await sleep(500);
    } catch {}
    await element(by.id('editor-lang-en')).atIndex(0).tap();
    await sleep(5000);
    cpu('suggestions on, idle');
    await tapIdWhenFree('settings-tab-features'); await sleep(1000);
    await tapIdWhenFree('feature-word-suggestions'); await sleep(3000);
    cpu('suggestions off, idle');
    await tapIdWhenFree('feature-word-suggestions'); await sleep(3000);
    cpu('suggestions back on, idle');
  });
});
