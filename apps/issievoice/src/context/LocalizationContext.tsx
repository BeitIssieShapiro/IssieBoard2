import { Strings, getStrings as getRawStrings } from '../localization/strings';
import { getDeviceLanguage } from '../../../../src/localization';
import { createLocalization } from '../../../../src/localization/createLocalization';

export type { Language, Strings } from '../localization/strings';

export const { LocalizationProvider, useLocalization } =
  createLocalization<Strings>(getRawStrings, getDeviceLanguage);
