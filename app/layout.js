import './globals.css';
import './experience.css';

export const metadata = {
  title: 'Backend Fieldguide | Learn ecommerce, build with AI',
  description: '60 interactive lessons that explain how an ecommerce backend works, why each part exists, and how to ask AI for precise, verifiable changes.',
  authors: [{ name: 'harshitgupta31415' }],
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
