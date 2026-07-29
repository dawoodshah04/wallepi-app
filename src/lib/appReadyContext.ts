import { createContext, useContext } from 'react';

type AppReadyContextType = {
  signalReady: () => void;
};

export const AppReadyContext = createContext<AppReadyContextType>({
  signalReady: () => {},
});

export function useAppReady() {
  return useContext(AppReadyContext);
}
