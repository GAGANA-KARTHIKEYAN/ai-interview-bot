// src/app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "AI Interview Bot",
  description: "AI powered interview preparation platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
        }}
      >
        {children}
      </body>
    </html>
  );
}
