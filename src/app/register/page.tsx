import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { signUpAction } from "@/app/actions/auth";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Регистрация</h1>
      <AuthForm action={signUpAction} mode="register" />
      <p className="mt-4 text-sm text-slate-400">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-orange-400 hover:underline">Вход</Link>
      </p>
    </div>
  );
}
