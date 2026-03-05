import { useCallback, useEffect, useState } from "react";

/**
 * Simple hook to fetch data from the user dashboard API.
 * Returns { data, loading, error, refetch }.
 */
export function useDashboardAPI(path, options = {}) {
  const { skip = false, params = {} } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);

  const qs = new URLSearchParams(params).toString();
  const url = `/api/user${path}${qs ? `?${qs}` : ""}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Sesi berakhir, silakan login ulang");
        throw new Error(`Error ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (!skip) fetchData();
  }, [fetchData, skip]);

  return { data, loading, error, refetch: fetchData };
}
