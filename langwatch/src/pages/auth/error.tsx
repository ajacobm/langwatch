import { type Session } from "next-auth";
import { useEffect } from "react";

import { usePublicEnv } from "../../hooks/usePublicEnv";

export default function Error({ session }: { session: Session | null }) {
  const publicEnv = usePublicEnv();
  const isAuth0 = publicEnv.data?.NEXTAUTH_PROVIDER === "auth0";

  useEffect(() => {
    if (!publicEnv.data) {
      return;
    }

    setTimeout(() => {
      if (typeof window !== "undefined" && typeof document !== "undefined") {
        if (isAuth0) {
          const fromReferrer = !!document.referrer;
          if (fromReferrer) {
            // @ts-ignore
            window.location = document.referrer;
          } else {
            // @ts-ignore
            window.location = "/";
          }
        } else {
          // @ts-ignore
          window.location = "/auth/signin";
        }
      }
    }, 3000);
  }, [publicEnv.data, isAuth0, session]);

  return (
    <div style={{ padding: "12px" }}>
      Auth Error: Redirecting back to Sign in... Click <a href="/">here</a> if
      you are not redirected within 5 seconds.
    </div>
  );
}
