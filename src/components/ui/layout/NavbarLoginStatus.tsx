"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface NavbarLoginStatusContextValue {
  showLoginStatus: boolean;
  setShowLoginStatus: (show: boolean) => void;
}

const NavbarLoginStatusContext =
  createContext<NavbarLoginStatusContextValue>({
    showLoginStatus: false,
    setShowLoginStatus: () => {},
  });

export function NavbarLoginStatusProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [showLoginStatus, setShowLoginStatus] = useState(false);
  const value = useMemo(
    () => ({ showLoginStatus, setShowLoginStatus }),
    [showLoginStatus]
  );

  return (
    <NavbarLoginStatusContext.Provider value={value}>
      {children}
    </NavbarLoginStatusContext.Provider>
  );
}

export function useNavbarLoginStatus() {
  return useContext(NavbarLoginStatusContext);
}

export function ShowNavbarLoginStatus() {
  const { setShowLoginStatus } = useNavbarLoginStatus();

  useEffect(() => {
    setShowLoginStatus(true);
    return () => setShowLoginStatus(false);
  }, [setShowLoginStatus]);

  return null;
}

