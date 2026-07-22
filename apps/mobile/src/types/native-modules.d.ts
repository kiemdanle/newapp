declare module 'react-native-vector-icons/Ionicons' {
  import type { ComponentType } from 'react';
  import type { TextProps } from 'react-native';

  export interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }

  const Ionicons: ComponentType<IconProps> & { glyphMap: Record<string, number> };
  export default Ionicons;
}

declare module 'react-native-config' {
  const Config: Record<string, string | undefined>;
  export default Config;
}
