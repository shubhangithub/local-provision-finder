import { useLayoutEffect } from 'react';
export type PageWidth = 'reading' | 'wide';
/**
 * Says how wide the frame should be while the calling page is on screen. The width is a data attribute on the
 * document so the header and footer, which sit outside the page, resize with it.
 */
export function usePageWidth(width: PageWidth) {
  useLayoutEffect(() => {
    document.documentElement.dataset.width = width;
    return () => { document.documentElement.dataset.width = 'reading'; };
  }, [width]);
}
