interface SpaceInfo {
  pluginName: string;
  spaceId: string;
}

let SpaceInfo: SpaceInfo | null = null;

const configureSpaceInfo = (props: SpaceInfo) => {
  SpaceInfo = props;
};

export { SpaceInfo, configureSpaceInfo };
