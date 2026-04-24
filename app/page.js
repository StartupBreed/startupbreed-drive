import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]/route';
import DriveApp from './components/DriveApp';
import LoginPage from './components/LoginPage';

export default async function Home() {
  const session = await getServerSession(authOptions);
  return session ? <DriveApp session={session} /> : <LoginPage />;
}
