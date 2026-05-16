"use client";

import { SearchIcon } from "./icons";

type Props = {
  positions: string[];
  position: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  onChange: (patch: Partial<{
    position: string;
    dateFrom: string;
    dateTo: string;
    search: string;
  }>) => void;
  onClear: () => void;
  resultCount: number;
};

export function FilterBar(props: Props) {
  return (
    <div className="card-accent p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
            Position
          </label>
          <select
            className="input"
            value={props.position}
            onChange={(e) => props.onChange({ position: e.target.value })}
          >
            <option value="">All positions</option>
            {props.positions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
            Applied from
          </label>
          <input
            type="date"
            className="input"
            value={props.dateFrom}
            onChange={(e) => props.onChange({ dateFrom: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
            Applied to
          </label>
          <input
            type="date"
            className="input"
            value={props.dateTo}
            onChange={(e) => props.onChange({ dateTo: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
            Search
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              placeholder="Name or email"
              className="input pl-9"
              value={props.search}
              onChange={(e) => props.onChange({ search: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm pt-3 border-t border-slate-100">
        <span className="text-slate-600">
          <strong className="text-slate-900">{props.resultCount}</strong> candidate
          {props.resultCount === 1 ? "" : "s"} match
        </span>
        <button
          onClick={props.onClear}
          className="text-brand-600 hover:text-brand-700 font-medium hover:underline"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
