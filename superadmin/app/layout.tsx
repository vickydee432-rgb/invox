import "./globals.css";

export const metadata = {
  title: "INVOX · Admin Console",
  description: "Usage, performance, and analytics across a company's branches"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
