'use client';

import { useTransition } from 'react';

import { moveDepartmentAction } from './actions';

export function MoveButtons({ id, first, last }: { id: string; first: boolean; last: boolean }) {
  const [pending, start] = useTransition();
  const move = (dir: -1 | 1) => start(async () => void (await moveDepartmentAction(id, dir)));
  return (
    <span className="flex gap-1">
      <button type="button" className="btn-ghost h-11 w-11 px-0" aria-label="Yuqoriga" disabled={first || pending} onClick={() => move(-1)}>
        ↑
      </button>
      <button type="button" className="btn-ghost h-11 w-11 px-0" aria-label="Pastga" disabled={last || pending} onClick={() => move(1)}>
        ↓
      </button>
    </span>
  );
}
