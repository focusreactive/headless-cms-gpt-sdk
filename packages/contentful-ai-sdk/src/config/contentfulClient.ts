import type { CMAClient } from '@contentful/app-sdk';

let contentfulClient: CMAClient | null = null;

export const initContentfulClient = (client: CMAClient) => {
    contentfulClient = client;
};

export const getContentfulClient = () => {
    return contentfulClient;
};
