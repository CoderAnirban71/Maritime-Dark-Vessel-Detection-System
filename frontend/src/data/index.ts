import type { IDataProvider } from './adapters/DataProvider';
import { DemoDataProvider } from './adapters/DemoDataProvider';
import { ApiDataProvider } from './adapters/ApiDataProvider';

const useRealApi = import.meta.env.VITE_USE_API === 'true';

export const dataService: IDataProvider = useRealApi
  ? new ApiDataProvider()
  : new DemoDataProvider();

export * from './adapters/DataProvider';
export * from './adapters/DemoDataProvider';
export * from './adapters/ApiDataProvider';
