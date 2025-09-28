import { search as firecrawlSearch } from './firecrawl';
import { search as cseSearch } from './cse';

export const providers = {
  firecrawl: { search: firecrawlSearch },
  cse: { search: cseSearch },
  database: { search: async ({ q }: { q: string }) => ({ items: [], debug: {} }) }
};
