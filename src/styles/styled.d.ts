import "styled-components";
import type { AppTheme } from "./theme";

declare module "styled-components" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- standard styled-components theme augmentation
  export interface DefaultTheme extends AppTheme {}
}
