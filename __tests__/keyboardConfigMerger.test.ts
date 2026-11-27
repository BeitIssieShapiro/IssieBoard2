/**
 * Builds the keyboards the native extensions render (src/utils/keyboardConfigMerger.ts):
 * language filtering, structural keys, mobile/large variants, keyset toggles, preview transform.
 * The last block runs the real keyboard sources in keyboards/ through the pipeline.
 */
import {
    applyRowInjections, buildBottomRow, buildKeyboardConfig, filterKeysByLanguage, filterSettingsButton,
    filterStructuralKeys, resolveRowsForVariant, suffixKeysetReferences, transformConfigForPreview,
} from '../src/utils/keyboardConfigMerger';

const he = require('../keyboards/he.json');
const en = require('../keyboards/en.json');
const ar = require('../keyboards/ar.json');

describe('filters', () => {
    test('filterKeysByLanguage keeps unrestricted and matching keys and strips forLanguages', () => {
        const keys = [{ value: 'a' }, { value: '@', forLanguages: ['en'] }, { value: '₪', forLanguages: ['he'] }];
        expect(filterKeysByLanguage(keys, 'he')).toEqual([{ value: 'a' }, { value: '₪' }]);
    });

    test('filterStructuralKeys honours language, diacritics and keyset restrictions', () => {
        const keys = [
            { type: 'nikkud', ifHasDiacritics: true, forKeysets: ['abc'] },
            { type: 'enter' },
            { value: '@', forLanguages: ['en'] },
        ];
        expect(filterStructuralKeys(keys, 'he', true, 'abc')).toEqual([{ type: 'nikkud' }, { type: 'enter' }]);
        expect(filterStructuralKeys(keys, 'he', true, '123')).toEqual([{ type: 'enter' }]);
        expect(filterStructuralKeys(keys, 'en', false, 'abc')).toEqual([{ type: 'enter' }, { value: '@' }]);
    });

    test('a disabled settings button gives its width to the space key', () => {
        const keys = [{ type: 'settings', width: 1.5 }, { value: ' ', width: 4 }, { value: 'x' }];
        expect(filterSettingsButton(keys, false)).toEqual([{ value: ' ', width: 5.5 }, { value: 'x' }]);
        expect(filterSettingsButton(keys, true)).toBe(keys);
        // Hebrew space caption, no explicit widths
        expect(filterSettingsButton([{ type: 'settings' }, { caption: 'רווח' }], false)).toEqual([{ caption: 'רווח', width: 2 }]);
    });
});

describe('variants and structure', () => {
    const keyset = {
        id: 'abc',
        rows: [{ keys: [{ value: 'q' }] }, { keys: [{ value: 'a' }] }, { keys: [{ value: 'z' }] }],
        largeRows: { '1': { keys: [{ value: 'A-large' }] } },
    };

    test('resolveRowsForVariant applies per-row overrides and deep-copies', () => {
        const large = resolveRowsForVariant(keyset, 'large');
        expect(large.map(r => r.keys[0].value)).toEqual(['q', 'A-large', 'z']);
        large[0].keys[0].value = 'changed';
        expect(keyset.rows[0].keys[0].value).toBe('q');
        expect(resolveRowsForVariant(keyset, 'mobile').map(r => r.keys[0].value)).toEqual(['q', 'a', 'z']);
    });

    test('applyRowInjections prepends/appends structural keys; a keyset override replaces the defaults', () => {
        const template = {
            firstRow: { append: [{ type: 'backspace' }] },
            lastRow: { prepend: [{ type: 'shift' }], append: [{ type: 'enter', forLanguages: ['en'] }] },
            keysetOverrides: { '123': { lastRow: { prepend: [{ type: 'keyset' }] } } },
        };
        const rows = applyRowInjections(keyset.rows, template, 'he', false, 'abc');
        expect(rows[0].keys.map(k => k.value ?? k.type)).toEqual(['q', 'backspace']);
        expect(rows[2].keys.map(k => k.value ?? k.type)).toEqual(['shift', 'z']);
        expect(keyset.rows[0].keys).toHaveLength(1); // input untouched

        const symbols = applyRowInjections(keyset.rows, template, 'he', false, '123');
        expect(symbols[0].keys).toHaveLength(1);
        expect(symbols[2].keys.map(k => k.value ?? k.type)).toEqual(['keyset', 'z']);
    });

    test('buildBottomRow resolves space and keyset toggles per target keyset and variant', () => {
        const labels = { abcLabel: 'אבג', symbolsLabel: '123', spaceCaption: 'רווח' };
        const tpl = [{ type: 'keyset', width: 1.5 }, { type: 'space', flex: true }, { type: 'nikkud', ifHasDiacritics: true, forKeysets: ['abc'] }];

        const abc = buildBottomRow(tpl, 'he', true, labels, 'abc', 'large');
        expect(abc.keys[0]).toMatchObject({ type: 'keyset', width: 1.5, keysetValue: '123_large', label: '123', returnKeysetValue: 'abc_large' });
        expect(abc.keys[1]).toMatchObject({ value: ' ', caption: 'רווח', flex: true });
        expect(abc.keys[1].type).toBeUndefined();
        expect(abc.keys[2]).toEqual({ type: 'nikkud' });

        const sym = buildBottomRow(tpl, 'he', true, labels, '123', 'mobile');
        expect(sym.keys[0]).toMatchObject({ keysetValue: 'abc', label: 'אבג', returnKeysetValue: '123' });
        expect(sym.keys.map(k => k.type)).not.toContain('nikkud');

        expect(buildBottomRow(tpl, 'he', false, labels, 'custom', 'mobile').keys[0])
            .toMatchObject({ keysetValue: 'abc', returnKeysetValue: 'custom', returnKeysetLabel: 'custom' });
    });

    test('suffixKeysetReferences only touches keyset references', () => {
        expect(suffixKeysetReferences([{ value: 'a' }, { type: 'keyset', keysetValue: '#+=', returnKeysetValue: '123' }], '_large'))
            .toEqual([{ value: 'a' }, { type: 'keyset', keysetValue: '#+=_large', returnKeysetValue: '123_large' }]);
    });
});

describe('transformConfigForPreview', () => {
    const config = {
        keysets: [{ id: 'abc', rows: [{ keys: [{ value: 'a' }, { value: 'b' }, { value: 'c' }, { hidden: true }, { type: 'backspace' }, { value: ' ' }] }] }],
        groups: [
            { name: 'vowels', items: ['a'], template: { visibilityMode: 'showOnly', color: 'red' } },
            { name: 'hidden', items: ['c'], template: { visibilityMode: 'hide', hidden: true } },
            { name: 'style', items: ['b'], template: { bgColor: 'blue', hidden: false } },
        ],
    };

    test('placeholders become invisible; hide -> opacity 0; showOnly adds a trailing inverse group', () => {
        const out = transformConfigForPreview(config);
        expect(out.keysets[0].rows[0].keys[3]).toEqual({ opacity: 0 });
        expect(out.groups![0].template).toEqual({ color: 'red' });
        expect(out.groups![1].template).toEqual({ opacity: 0 });
        expect(out.groups![2].template).toEqual({ bgColor: 'blue' });
        const inverse = out.groups![3];
        expect(inverse.name).toBe('_vowels_inverse_');
        expect(inverse.items.sort()).toEqual(['b', 'c']); // essential keys (space, backspace) stay visible
        expect(inverse.template.opacity).toBe(0);

        expect(transformConfigForPreview(config, { showOnlyOpacity: 0.3 }).groups![3].template.opacity).toBe(0.3);
        expect(config.groups[0].template.visibilityMode).toBe('showOnly'); // input untouched
    });

    test('a config without groups only fixes placeholders', () => {
        const out = transformConfigForPreview({ keysets: config.keysets });
        expect(out.groups).toBeUndefined();
        expect(out.keysets[0].rows[0].keys[3]).toEqual({ opacity: 0 });
    });
});

describe.each([['he', he], ['en', en], ['ar', ar]])('real keyboard source: %s', (lang, source) => {
    const config = buildKeyboardConfig(source, lang);
    const ids = config.keysets.map(k => k.id);

    test('every keyset has a mobile and a _large variant', () => {
        expect(ids).toEqual(expect.arrayContaining(['abc', 'abc_large', '123', '123_large', '#+=', '#+=_large']));
        expect(config).toMatchObject({ defaultKeyset: 'abc', keyboards: [lang], keyboardLanguage: lang });
        expect(!!config.diacritics).toBe(!!source.diacritics);
    });

    test('keyset toggle keys only point at keysets of the same variant that exist', () => {
        for (const ks of config.keysets) {
            const large = ks.id.endsWith('_large');
            for (const key of ks.rows.flatMap(r => r.keys)) {
                for (const ref of [key.keysetValue, key.returnKeysetValue].filter(Boolean) as string[]) {
                    expect(ids).toContain(ref);
                    expect(ref.endsWith('_large')).toBe(large);
                }
            }
        }
    });

    test('build-time properties never reach the runtime config; each keyset ends with a space bar', () => {
        for (const ks of config.keysets) {
            const keys = ks.rows.flatMap(r => r.keys) as any[];
            for (const k of keys) {
                expect(k.forLanguages).toBeUndefined();
                expect(k.ifHasDiacritics).toBeUndefined();
                expect(k.forKeysets).toBeUndefined();
            }
            expect(ks.rows[ks.rows.length - 1].keys.some((k: any) => k.value === ' ')).toBe(true);
        }
    });

    test('the nikkud key is on the letters keyset only, and only for languages with diacritics', () => {
        const nikkudIn = config.keysets.filter(ks => ks.rows.flatMap(r => r.keys).some(k => k.type === 'nikkud')).map(k => k.id);
        expect(nikkudIn.every(id => id.startsWith('abc'))).toBe(true);
        if (!source.diacritics) expect(nikkudIn).toEqual([]);
    });
});
