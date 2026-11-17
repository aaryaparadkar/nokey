import { Route, Routes } from "react-router";
import { Layout } from "@/components/layout";
import { HomePage } from "@/pages/home";
import { NotFoundPage } from "@/pages/not-found";
import { PastePage } from "@/pages/paste";
import { Placeholder } from "@/pages/placeholder";
import { RegisterPage } from "@/pages/register";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="p/:id" element={<PastePage />} />
        <Route path="login" element={<Placeholder title="Sign in" />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="account" element={<Placeholder title="Account" />} />
        <Route path="me" element={<Placeholder title="My pastes" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
