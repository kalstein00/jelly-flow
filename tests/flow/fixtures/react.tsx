import React, { useCallback } from 'react';
import { createRoot } from 'react-dom/client';

export function persist() { return 'saved'; }
export function unrelated() { return 'unrelated'; }
export function useClose() {
  const close = useCallback(() => persist(), []);
  return close;
}
export function Panel() {
  const close = useClose();
  function onClick() { return close(); }
  return <button onClick={onClick}>Save</button>;
}
createRoot(document.getElementById('root')!).render(<Panel />);
