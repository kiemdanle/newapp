import { renderWithTheme } from '../../helpers/renderWithTheme';
import { MD3Chip } from '../../../src/components/MD3Chip';
import { MD3ListRow } from '../../../src/components/MD3ListRow';
import { MD3FAB } from '../../../src/components/MD3FAB';
import { MD3TextField } from '../../../src/components/MD3TextField';

describe.each(['expyrico', 'expyricoDark'] as const)('MD3 primitives in %s', (theme) => {
  it('MD3Chip', () => {
    expect(renderWithTheme(<MD3Chip label="Dairy" selected />, theme).toJSON()).toMatchSnapshot();
  });
  it('MD3ListRow', () => {
    expect(renderWithTheme(<MD3ListRow leadingIcon="bell" title="Notifications" subtitle="On" />, theme).toJSON()).toMatchSnapshot();
  });
  it('MD3FAB', () => {
    expect(renderWithTheme(<MD3FAB icon="qrcode-scan" onPress={() => {}} accessibilityLabel="Scan" />, theme).toJSON()).toMatchSnapshot();
  });
  it('MD3TextField', () => {
    expect(renderWithTheme(<MD3TextField label="Email" value="" onChangeText={() => {}} />, theme).toJSON()).toMatchSnapshot();
  });
});
