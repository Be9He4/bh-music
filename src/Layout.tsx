import { NativeThemeProvider } from "@/components/ui/native-theme-provider";
import type { PropsWithChildren } from "react";
import { Toaster } from "react-hot-toast";

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <NativeThemeProvider
      attribute="class"
      enableSystem
      disableTransitionOnChange
    >
      {children}

      <Toaster
        position="top-center"
        gutter={12}
        containerStyle={{
          top: "calc(24px + var(--safe-area-top))",
        }}
        toastOptions={{
          duration: 2000,
          style: {
            padding: "12px 16px",
            fontSize: "14px",
            borderRadius: "8px",
            maxWidth: "90%",
            margin: "0 auto",
          },
        }}
      />
    </NativeThemeProvider>
  );
}
