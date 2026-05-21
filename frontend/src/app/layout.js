import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/components/AuthProvider';
import Header from '@/components/Header';

export const metadata = {
  title: 'منصة التقييم الذاتي للجمعيات التونسية',
  description: 'تقييم مدى امتثال الجمعيات التونسية للإطار القانوني - المرسوم 88 لسنة 2011',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <Header />
            <main>{children}</main>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
