// Mock KeyboardPreferences (default export — needs __esModule)
jest.mock('../../src/native/KeyboardPreferences', () => ({
  __esModule: true,
  default: {
    getProfile: jest.fn(),
    setProfile: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

import { symbolService } from '../../apps/issievoice/src/services/SymbolService';
import KeyboardPreferences from '../../src/native/KeyboardPreferences';

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
const mockGetProfile = KeyboardPreferences.getProfile as jest.MockedFunction<typeof KeyboardPreferences.getProfile>;
const mockSetProfile = KeyboardPreferences.setProfile as jest.MockedFunction<typeof KeyboardPreferences.setProfile>;

beforeEach(() => {
  jest.clearAllMocks();
  symbolService.clearCache();
});

const makeApiResponse = (id: number, violence = false, sex = false) => [
  { _id: id, violence, sex, keywords: [{ keyword: 'test' }] },
];

describe('SymbolService', () => {
  describe('getSymbolUrls', () => {
    test('fetches symbol URL from ARASAAC bestsearch API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeApiResponse(2517)),
      } as Response);

      const result = await symbolService.getSymbolUrls(['dog']);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.arasaac.org/api/pictograms/en/bestsearch/dog'
      );
      expect(result.get('dog')).toBe(
        'https://api.arasaac.org/api/pictograms/2517?download=false'
      );
    });

    test('returns cached result on second call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeApiResponse(2517)),
      } as Response);

      await symbolService.getSymbolUrls(['dog']);
      const result = await symbolService.getSymbolUrls(['dog']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.get('dog')).toBe(
        'https://api.arasaac.org/api/pictograms/2517?download=false'
      );
    });

    test('filters out violence=true results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { _id: 100, violence: true, sex: false },
          { _id: 200, violence: false, sex: false },
        ]),
      } as Response);

      const result = await symbolService.getSymbolUrls(['fight']);
      expect(result.get('fight')).toBe(
        'https://api.arasaac.org/api/pictograms/200?download=false'
      );
    });

    test('filters out sex=true results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { _id: 100, violence: false, sex: true },
          { _id: 200, violence: false, sex: false },
        ]),
      } as Response);

      const result = await symbolService.getSymbolUrls(['body']);
      expect(result.get('body')).toBe(
        'https://api.arasaac.org/api/pictograms/200?download=false'
      );
    });

    test('returns null when all results are unsafe', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { _id: 100, violence: true, sex: false },
        ]),
      } as Response);

      const result = await symbolService.getSymbolUrls(['bad']);
      expect(result.get('bad')).toBeNull();
    });

    test('returns null on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await symbolService.getSymbolUrls(['xyzzy']);
      expect(result.get('xyzzy')).toBeNull();
    });

    test('returns null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await symbolService.getSymbolUrls(['hello']);
      expect(result.get('hello')).toBeNull();
    });

    test('detects Hebrew and uses he locale', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeApiResponse(3000)),
      } as Response);

      await symbolService.getSymbolUrls(['שלום']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/he/bestsearch/')
      );
    });

    test('deduplicates concurrent requests for same word', async () => {
      let resolvePromise: (value: Response) => void;
      const pendingPromise = new Promise<Response>(resolve => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValueOnce(pendingPromise);

      const promise1 = symbolService.getSymbolUrls(['dog']);
      const promise2 = symbolService.getSymbolUrls(['dog']);

      resolvePromise!({
        ok: true,
        json: () => Promise.resolve(makeApiResponse(2517)),
      } as Response);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1.get('dog')).toBe(result2.get('dog'));
    });
  });

  describe('loadCache', () => {
    test('loads persistent cache from KeyboardPreferences', async () => {
      mockGetProfile.mockResolvedValueOnce(
        JSON.stringify({ dog_en: 'https://api.arasaac.org/api/pictograms/2517?download=false' })
      );

      await symbolService.loadCache();
      const result = await symbolService.getSymbolUrls(['dog']);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.get('dog')).toBe(
        'https://api.arasaac.org/api/pictograms/2517?download=false'
      );
    });
  });

  describe('persistCache', () => {
    test('persists cache after new fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeApiResponse(2517)),
      } as Response);

      await symbolService.getSymbolUrls(['dog']);

      expect(mockSetProfile).toHaveBeenCalledWith(
        expect.stringContaining('"dog_en"'),
        'issievoice_symbol_cache'
      );
    });
  });
});
