interface SpaceInfo {
  pluginName: string;
}

let SpaceInfo: SpaceInfo | null = null;

export const getSpaceInfo = () => {
  return SpaceInfo;
};

export const configureSpaceInfo = (props: SpaceInfo) => {
  SpaceInfo = props;
};
