import {
  createContext,
  useContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

export type ProjectStatusValue = {
  busy: string | null;
  error: string | null;
  notice: string | null;
  setBusy: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
};

const ProjectStatusContext = createContext<ProjectStatusValue | null>(null);

export function ProjectStatusProvider({
  value,
  children,
}: {
  value: ProjectStatusValue;
  children: ReactNode;
}) {
  return (
    <ProjectStatusContext.Provider value={value}>{children}</ProjectStatusContext.Provider>
  );
}

export function useProjectStatus(): ProjectStatusValue {
  const ctx = useContext(ProjectStatusContext);
  if (!ctx) {
    throw new Error('useProjectStatus must be used within a ProjectStatusProvider');
  }
  return ctx;
}
