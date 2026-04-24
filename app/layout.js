import './globals.css';
import Providers from './components/Providers';

export const metadata = {
  title: 'Drive Manager',
  description: 'Manage your Google Drive files with ease',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
