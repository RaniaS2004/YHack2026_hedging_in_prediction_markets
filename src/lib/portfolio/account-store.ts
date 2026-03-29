"use client";

import { Platform } from "@/types";

export interface ConnectedAccountRecord {
  platform: Platform;
  platformName: string;
  accountLabel: string;
  loginEmail: string;
  accountRef: string;
  syncMode: "read_only" | "trading";
  connectedAt: string;
}

export interface PortfolioHedgeLegRecord {
  marketId: string;
  marketTitle: string;
  platform: Platform;
  side: "YES" | "NO";
  size: number;
  price: number;
}

export interface PortfolioHedgeRecord {
  id: string;
  createdAt: string;
  sourceScope: "portfolio" | "selected_positions";
  sourceLabel: string;
  objective: string;
  protectionLevel: string;
  mandate: string;
  positions: {
    id: string;
    title: string;
    platform: Platform;
    side: "YES" | "NO";
    quantity: number;
  }[];
  estimatedSpend: number;
  hedgeRatio: number;
  residualBasisRisk: number;
  status: "monitoring" | "executing" | "active";
  legs: PortfolioHedgeLegRecord[];
}

interface PortfolioAccountState {
  accounts: ConnectedAccountRecord[];
  hedges: PortfolioHedgeRecord[];
}

const STORAGE_KEY = "hedgekit-portfolio-account-v1";
const STORAGE_EVENT = "hedgekit-portfolio-store";

export const EMPTY_PORTFOLIO_ACCOUNT_STATE: PortfolioAccountState = {
  accounts: [],
  hedges: [],
};

let cachedRawState: string | null = null;
let cachedParsedState: PortfolioAccountState = EMPTY_PORTFOLIO_ACCOUNT_STATE;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadPortfolioAccountState(): PortfolioAccountState {
  if (!canUseStorage()) return EMPTY_PORTFOLIO_ACCOUNT_STATE;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    cachedRawState = null;
    cachedParsedState = EMPTY_PORTFOLIO_ACCOUNT_STATE;
    return cachedParsedState;
  }

  if (raw === cachedRawState) {
    return cachedParsedState;
  }

  try {
    const parsed = JSON.parse(raw) as PortfolioAccountState;
    cachedRawState = raw;
    cachedParsedState = {
      accounts: parsed.accounts ?? [],
      hedges: parsed.hedges ?? [],
    };
    return cachedParsedState;
  } catch {
    cachedRawState = null;
    cachedParsedState = EMPTY_PORTFOLIO_ACCOUNT_STATE;
    return cachedParsedState;
  }
}

export function savePortfolioAccountState(state: PortfolioAccountState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

export function subscribePortfolioAccountState(onChange: () => void) {
  if (!canUseStorage()) {
    return () => {};
  }

  const handleStorage = (event: Event) => {
    if (event instanceof StorageEvent && event.key && event.key !== STORAGE_KEY) {
      return;
    }
    onChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(STORAGE_EVENT, handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(STORAGE_EVENT, handleStorage);
  };
}

export function upsertConnectedAccount(account: ConnectedAccountRecord) {
  const state = loadPortfolioAccountState();
  const nextAccounts = [
    account,
    ...state.accounts.filter((item) => item.platform !== account.platform),
  ];
  const nextState = {
    ...state,
    accounts: nextAccounts,
  };
  savePortfolioAccountState(nextState);
  return nextState;
}

export function removeConnectedAccount(platform: Platform) {
  const state = loadPortfolioAccountState();
  const nextState = {
    ...state,
    accounts: state.accounts.filter((item) => item.platform !== platform),
  };
  savePortfolioAccountState(nextState);
  return nextState;
}

export function addPortfolioHedge(record: PortfolioHedgeRecord) {
  const state = loadPortfolioAccountState();
  const nextState = {
    ...state,
    hedges: [record, ...state.hedges],
  };
  savePortfolioAccountState(nextState);
  return nextState;
}

export function markPortfolioHedgeActive(id: string) {
  const state = loadPortfolioAccountState();
  const nextState = {
    ...state,
    hedges: state.hedges.map((hedge) =>
      hedge.id === id ? { ...hedge, status: "active" as const } : hedge
    ),
  };
  savePortfolioAccountState(nextState);
  return nextState;
}

export function buildMonitoringSeries(seed: string) {
  const series: number[] = [];
  let value = 52 + (seed.length % 9);

  for (let i = 0; i < 12; i += 1) {
    const drift = ((seed.charCodeAt(i % seed.length) || 11) % 7) - 3;
    value = Math.max(12, Math.min(92, value + drift));
    series.push(value);
  }

  return series;
}
