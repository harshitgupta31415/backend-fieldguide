import './globals.css';
import './experience.css';
import { lessons } from '../lib/course.mjs';

export const metadata = {
  title: 'Backend Fieldguide | Learn ecommerce, build with AI',
  description: `${lessons.length} interactive lessons and practical simulations for understanding ecommerce backends and guiding AI with precise, verifiable instructions.`,
  authors: [{ name: 'harshitgupta31415' }],
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
