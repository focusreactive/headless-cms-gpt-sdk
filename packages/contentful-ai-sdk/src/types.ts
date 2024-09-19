export type EntryFieldSysLink = {
  type: 'Link';
  linkType: string;
  id: string;
};

export type EntryField = Record<string, string | { sys: EntryFieldSysLink }>;
