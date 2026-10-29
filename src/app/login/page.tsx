import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { signInAction } from "@/app/actions/auth";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Вход</h1>
      <AuthForm action={signInAction} mode="login" />
      <p className="mt-4 text-sm text-slate-400">
        Нет аккаунта?{" "}
        <Link href="/register" className="text-orange-400 hover:underline">Регистрация</Link>
      </p>
    </div>
  );
}
