import { usePageWidth, type PageWidth } from '../lib/page-width';
/** Renders nothing; while mounted, the page frame uses this width. */
export default function PageWidthClaim({ width }: { width: PageWidth }) {
  usePageWidth(width);
  return null;
}
