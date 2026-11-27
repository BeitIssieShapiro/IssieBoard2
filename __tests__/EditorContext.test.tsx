/**
 * The keyboard editor's state (src/context/EditorContext.tsx), driven through the
 * public hook like the toolbox panels do: selection, style groups, dirty tracking.
 */
import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { EditorProvider, getKeyValueFromPositionId, keyIdToString, stringToKeyId, useEditor } from '../src/context/EditorContext';

const config: any = {
    backgroundColor: '#E0E0E0',
    defaultKeyset: 'abc',
    keyboards: ['he'],
    defaultKeyboard: 'he',
    groups: [],
    keysets: [
        { id: 'abc', rows: [{ keys: [{ value: 'א' }, { value: 'ב' }, { type: 'backspace' }] }, { keys: [{ value: 'א' }, { caption: 'space', value: ' ' }] }] },
        { id: '123', rows: [{ keys: [{ value: '1' }, { label: 'ABC', type: 'keyset' }] }] },
    ],
};

const setup = (initialStyleGroups: any[] = []) => renderHook(() => useEditor(), {
    wrapper: ({ children }: any) => <EditorProvider initialConfig={config} initialStyleGroups={initialStyleGroups}>{children}</EditorProvider>,
});

test('position ids round-trip and resolve to key values', () => {
    expect(stringToKeyId(keyIdToString({ keysetId: 'abc', rowIndex: 1, keyIndex: 0 }))).toEqual({ keysetId: 'abc', rowIndex: 1, keyIndex: 0 });
    expect(getKeyValueFromPositionId('abc:0:2', config.keysets)).toBe('backspace');
    expect(getKeyValueFromPositionId('123:0:1', config.keysets)).toBe('ABC'); // label before type
    expect(getKeyValueFromPositionId('nope:0:0', config.keysets)).toBeNull();
    expect(getKeyValueFromPositionId('abc:9:0', config.keysets)).toBeNull();
});

test('useEditor outside the provider throws', () => {
    jest.spyOn(console, 'error').mockImplementation(() => { });
    expect(() => renderHook(() => useEditor())).toThrow(/within an EditorProvider/);
});

test('selection: single select replaces, toggle adds/removes, test mode and keyset switch clear it', () => {
    const { result } = setup();
    act(() => result.current.selectKey({ keysetId: 'abc', rowIndex: 0, keyIndex: 0 }));
    act(() => result.current.selectKey({ keysetId: 'abc', rowIndex: 0, keyIndex: 1 }));
    expect(result.current.state.selectedKeys).toEqual(['abc:0:1']);

    act(() => result.current.toggleKeySelection({ keysetId: 'abc', rowIndex: 0, keyIndex: 0 }));
    expect(result.current.state.selectedKeys).toEqual(['abc:0:1', 'abc:0:0']);
    act(() => result.current.toggleKeySelection({ keysetId: 'abc', rowIndex: 0, keyIndex: 1 }));
    expect(result.current.state.selectedKeys).toEqual(['abc:0:0']);

    act(() => result.current.setMode('test'));
    expect(result.current.state.selectedKeys).toEqual([]);
    act(() => result.current.setMode('edit'));
    act(() => result.current.selectKeys(['abc:0:0']));
    act(() => result.current.dispatch({ type: 'SET_ACTIVE_KEYSET', payload: '123' }));
    expect(result.current.state).toMatchObject({ activeKeyset: '123', selectedKeys: [] });
});

test('groups store key values (portable across layouts) and de-duplicate', () => {
    const { result } = setup();
    act(() => result.current.selectKeys(['abc:0:0', 'abc:1:0', 'abc:0:2'])); // א twice + backspace
    act(() => result.current.createGroup('vowels', { bgColor: 'red' }));

    const g = result.current.state.styleGroups[0];
    expect(g).toMatchObject({ name: 'vowels', members: ['א', 'backspace'], style: { bgColor: 'red' }, active: true });
    expect(result.current.state.isDirty).toBe(true);
    expect(result.current.state.activeGroupId).toBe(g.id);
    expect(result.current.getComputedKeyStyle('א')).toEqual({ bgColor: 'red' });
});

test('creating a group needs a selection; from-values needs members', () => {
    const { result } = setup();
    act(() => result.current.createGroup('empty', {}));
    act(() => result.current.createGroupFromValues('none', [], {}));
    expect(result.current.state.styleGroups).toEqual([]);
    expect(result.current.state.isDirty).toBe(false);
});

test('activating a group selects every key with its values, in all keysets', () => {
    const { result } = setup([{ id: 'g1', name: 'g', members: ['א', '1'], style: {}, createdAt: '', active: true }]);
    act(() => result.current.setActiveGroup('g1'));
    expect(result.current.state.selectedKeys).toEqual(['abc:0:0', 'abc:1:0', '123:0:0']);
    act(() => result.current.setActiveGroup('missing'));
    expect(result.current.state.activeGroupId).toBeNull();
});

test('add/remove members, style merge, toggling and later groups overriding earlier ones', () => {
    const { result } = setup([
        { id: 'g1', name: 'a', members: ['א'], style: { color: 'black', bgColor: 'white' }, createdAt: '', active: true },
        { id: 'g2', name: 'b', members: ['א'], style: { bgColor: 'blue' }, createdAt: '', active: true },
    ]);
    expect(result.current.getComputedKeyStyle('א')).toEqual({ color: 'black', bgColor: 'blue' });

    act(() => result.current.toggleGroupActive('g2'));
    expect(result.current.getComputedKeyStyle('א')).toEqual({ color: 'black', bgColor: 'white' });

    act(() => result.current.addToGroup('g1', ['abc:0:1', 'abc:0:1']));
    expect(result.current.getGroupById('g1')!.members).toEqual(['א', 'ב']);
    act(() => result.current.removeFromGroup('g1', ['abc:0:0']));
    expect(result.current.getGroupById('g1')!.members).toEqual(['ב']);
    act(() => result.current.updateGroupStyle('g1', { color: 'green' }));
    expect(result.current.getGroupById('g1')!.style).toEqual({ color: 'green', bgColor: 'white' });
    expect(result.current.getKeyGroups('ב').map(g => g.id)).toEqual(['g1']);
});

test('deleting the last group marks the list as cleared (no fallback to config.groups)', () => {
    const { result } = setup([{ id: 'g1', name: 'a', members: ['א'], style: {}, createdAt: '', active: true }]);
    act(() => result.current.setActiveGroup('g1'));
    act(() => result.current.deleteGroup('g1'));
    expect(result.current.state).toMatchObject({ styleGroups: [], styleGroupsCleared: true, activeGroupId: null, isDirty: true });

    // loading a profile starts clean again
    act(() => result.current.setConfig(config, []));
    expect(result.current.state).toMatchObject({ styleGroupsCleared: false, isDirty: false, activeKeyset: 'abc' });
});

test('applyStyleToSelection creates uniquely named groups', () => {
    const { result } = setup([{ id: 'g0', name: 'new-group1', members: ['x'], style: {}, createdAt: '', active: true }]);
    act(() => result.current.selectKeys(['abc:0:1']));
    act(() => result.current.applyStyleToSelection({ color: 'red' }));
    expect(result.current.state.styleGroups.map(g => g.name)).toEqual(['new-group1', 'new-group2']);
});

test('global settings mark the profile dirty', () => {
    const { result } = setup();
    act(() => result.current.updateBackgroundColor('#000'));
    expect(result.current.state.config.backgroundColor).toBe('#000');
    expect(result.current.state.isDirty).toBe(true);
    act(() => result.current.dispatch({ type: 'MARK_SAVED' }));
    expect(result.current.state.isDirty).toBe(false);
    act(() => result.current.updateKeyGap(4));
    expect(result.current.state.isDirty).toBe(true);
});
