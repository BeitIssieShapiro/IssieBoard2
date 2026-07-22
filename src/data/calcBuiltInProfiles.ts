import { StyleGroup } from '../../types';

export interface CalcBuiltInProfile {
  id: string;
  name: string;
  config: {
    backgroundColor?: string;
    fontSizePreset?: string;
    fontSizePreset_large?: string;
    heightPreset?: string;
    heightPreset_large?: string;
    fontWeight?: string;
    fontWeight_large?: string;
    keyGap?: number;
    keyGap_large?: number;
  };
  styleGroups: Omit<StyleGroup, 'id' | 'createdAt'>[];
}

const NUMBER_KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '+/-', 'pi'];
const OPERATOR_KEYS = ['⌫', 'AC', '%', '/', '*', '-', '+', '=', '(', ')', 'x^2', 'sin(', 'cos(', 'tan(', 'sqrt(', 'log('];

export const CALC_BUILT_IN_PROFILES: CalcBuiltInProfile[] = [
  {
    id: 'default',
    name: 'Default',
    config: {
      backgroundColor: 'default',
      fontSizePreset: 'normal',
      fontSizePreset_large: 'normal',
      heightPreset: 'normal',
      heightPreset_large: 'x-tall',
      fontWeight: 'regular',
      fontWeight_large: 'heavy',
      keyGap: 2,
      keyGap_large: 4,
    },
    styleGroups: [],
  },
  {
    id: 'classic',
    name: 'IssieCalc Classic',
    config: {
      backgroundColor: '#A0A0A0',
      fontSizePreset: 'normal',
      fontSizePreset_large: 'normal',
      heightPreset: 'normal',
      heightPreset_large: 'x-tall',
      fontWeight: 'regular',
      fontWeight_large: 'heavy',
      keyGap: 3,
      keyGap_large: 4,
    },
    styleGroups: [
      {
        name: 'Numbers',
        members: NUMBER_KEYS,
        style: { color: '#0000FF', bgColor: '#FFEB3B' },
        active: true,
        isBuiltIn: true,
      },
      {
        name: 'Operators',
        members: OPERATOR_KEYS,
        style: { color: '#000000', bgColor: '#4DD0E1' },
        active: true,
        isBuiltIn: true,
      },
    ],
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    config: {
      backgroundColor: '#000000',
      fontSizePreset: 'large',
      fontSizePreset_large: 'large',
      heightPreset: 'tall',
      heightPreset_large: 'x-tall',
      fontWeight: 'black',
      fontWeight_large: 'black',
      keyGap: 6,
      keyGap_large: 8,
    },
    styleGroups: [
      {
        name: 'Numbers',
        members: NUMBER_KEYS,
        style: { color: '#000000', bgColor: '#FFEB3B' },
        active: true,
        isBuiltIn: true,
      },
      {
        name: 'Operators',
        members: OPERATOR_KEYS,
        style: { color: '#FFFFFF', bgColor: '#555555' },
        active: true,
        isBuiltIn: true,
      },
    ],
  },
];

export const getCalcBuiltInProfile = (id: string): CalcBuiltInProfile | undefined =>
  CALC_BUILT_IN_PROFILES.find(p => p.id === id);

export const CALC_BUILT_IN_PROFILE_ID_PREFIX = 'calc-';

export const getCalcBuiltInProfileId = (templateId: string): string =>
  `${CALC_BUILT_IN_PROFILE_ID_PREFIX}${templateId}`;

export const extractCalcTemplateId = (profileId: string): string | undefined => {
  if (!profileId.startsWith(CALC_BUILT_IN_PROFILE_ID_PREFIX)) return undefined;
  const templateId = profileId.slice(CALC_BUILT_IN_PROFILE_ID_PREFIX.length);
  return CALC_BUILT_IN_PROFILES.some(p => p.id === templateId) ? templateId : undefined;
};

export const isCalcBuiltInProfileId = (profileId: string): boolean =>
  extractCalcTemplateId(profileId) !== undefined;
