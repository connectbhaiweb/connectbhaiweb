/* Search, rows per page and pager, as on every list of the website: one version for a list already in the app and one
   where the server returns a page at a time. */
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import type { Page } from '../lib/api/types';
import { errMsg } from '../lib/forms';
import { Input, Select } from './forms';
import { Empty, Row, Skeleton } from './kit';
import { T } from './text';
import { colors, radius } from './theme';

const SIZES = [10, 25, 50, 100].map((n) => ({ value: String(n), label: String(n) }));

function Bar({ size, setSize, q, setQ, placeholder, label }: { size: number; setSize: (n: number) => void; q: string; setQ: (v: string) => void; placeholder: string; label: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Row wrap={false} style={{ justifyContent: 'flex-end' }}>
        <T s={14} c={colors.muted}>Rows</T>
        <View style={{ width: 86 }}>
          <Select label="Rows per page" noLabel compact value={String(size)} onChange={(v) => setSize(Number(v))} options={SIZES} />
        </View>
      </Row>
      <Input label={label} noLabel placeholder={placeholder} value={q} onChangeText={setQ} autoCapitalize="none" returnKeyType="search" />
    </View>
  );
}

function Pager({ page, pages, setPage, count }: { page: number; pages: number; setPage: (p: number) => void; count: string }) {
  const nums: number[] = [];
  for (let p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
  const button = (key: string, text: string, to: number, on: boolean, disabled: boolean, label: string) => (
    <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on, disabled }} disabled={disabled} onPress={() => setPage(to)} hitSlop={4} style={{ minWidth: 38, height: 38, borderRadius: radius.sm, borderWidth: 1, borderColor: on ? colors.blue : colors.line, backgroundColor: on ? colors.blue : colors.surface, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}>
      <T s={14} w={700} c={on ? colors.white : colors.ink} raw>{text}</T>
    </Pressable>
  );
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T s={13} c={colors.muted}>{count}</T>
      <Row gap={6}>
        {button('prev', '‹', page - 1, false, page === 1, 'Previous page')}
        {nums.map((p, i) => (
          <Row key={p} gap={6}>
            {i > 0 && p - nums[i - 1] > 1 ? <T c={colors.muted} raw>…</T> : null}
            {button(String(p), String(p), p, p === page, false, `Page ${p}`)}
          </Row>
        ))}
        {button('next', '›', page + 1, false, page === pages, 'Next page')}
      </Row>
    </Row>
  );
}

const compact = (s: string) => s.replace(/[\s,+\-().]/g, '');

export function LocalList<X>({ items, text, render, empty }: { items: X[]; text: (x: X) => string; render: (x: X) => ReactNode; empty?: string }) {
  const [q, setQ] = useState('');
  const [size, setSize] = useState(10);
  const [wanted, setPage] = useState(1);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = items.filter((x) => {
    const h = text(x).toLowerCase();
    return words.every((w) => h.includes(w) || compact(h).includes(compact(w)));
  });
  const pages = Math.max(1, Math.ceil(hit.length / size));
  const page = Math.min(wanted, pages);
  const from = (page - 1) * size;
  if (!items.length) return empty ? <Empty><T w={800} center>{empty}</T></Empty> : null;
  return (
    <View style={{ gap: 12 }}>
      <Bar size={size} setSize={(n) => { setSize(n); setPage(1); }} q={q} setQ={(v) => { setQ(v); setPage(1); }} label="Search this table" placeholder="Search all columns…" />
      {hit.slice(from, from + size).map(render)}
      <Pager page={page} pages={pages} setPage={setPage} count={hit.length ? `${from + 1}–${Math.min(from + size, hit.length)} of ${hit.length}${hit.length !== items.length ? ` (filtered from ${items.length})` : ''}` : `No rows match “${q}”`} />
    </View>
  );
}

export function ServerList<X extends { id: string }>({ load, depsKey, render, empty, label }: { load: (page: number, size: number, q: string) => Promise<Page<X>>; depsKey: string; render: (x: X) => ReactNode; empty: string; label: string }) {
  const [q, setQ] = useState('');
  const [size, setSize] = useState(10);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<{ data?: Page<X>; error?: string }>({});
  useEffect(() => {
    let off = false;
    const timer = setTimeout(
      () => {
        load(page, size, q.trim())
          .then((data) => {
            if (off) return;
            const pages = Math.max(1, Math.ceil(data.total / size));
            if (page > pages) setPage(pages);
            setState({ data });
          })
          .catch((e) => !off && setState((s) => ({ ...s, error: errMsg(e) })));
      },
      q ? 250 : 0,
    );
    return () => {
      off = true;
      clearTimeout(timer);
    };
    // depsKey stands for everything else the loader depends on (filter, refresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, size, q, depsKey]);
  const { data, error } = state;
  const total = data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / size));
  const from = (page - 1) * size + 1;
  return (
    <View style={{ gap: 12 }}>
      <Bar size={size} setSize={(n) => { setSize(n); setPage(1); }} q={q} setQ={(v) => { setQ(v); setPage(1); }} label={label} placeholder="Search name, phone, code…" />
      {error && !data ? <T c={colors.bad}>{error}</T> : !data ? <Skeleton height={140} /> : data.items.length ? data.items.map(render) : <Empty><T w={800} center>{q.trim() ? `No rows match “${q.trim()}”.` : empty}</T></Empty>}
      {total ? <Pager page={page} pages={pages} setPage={setPage} count={`${from}–${Math.min(page * size, total)} of ${total}`} /> : null}
    </View>
  );
}
