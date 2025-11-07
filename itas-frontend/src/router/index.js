import { createRouter, createWebHistory } from "vue-router"
import DashboardPage from "@/pages/DashboardPage.vue"
import ProfilePage from "@/pages/ProfilePage.vue"
import LoginPage from "@/pages/LoginPage.vue"
import RegisterPage from "@/pages/RegisterPage.vue"
import ForgotPage from "@/pages/ForgotPage.vue"
import ResetPage from "@/pages/ResetPage.vue"
import TwoFASetupPage from "@/pages/TwoFASetupPage.vue"
import { useAuthStore } from "@/stores/auth"

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: LoginPage },
    { path: "/register", name: "register", component: RegisterPage },
    { path: "/forgot", name: "forgot", component: ForgotPage },
    { path: "/reset", name: "reset", component: ResetPage },
    { path: "/twofa-setup", name: "twofa-setup", component: TwoFASetupPage },
    { path: "/", redirect: "/dashboard" },
    { path: "/dashboard", name: "dashboard", component: DashboardPage, meta: { requiresAuth: true } },
    { path: "/profile", name: "profile", component: ProfilePage, meta: { requiresAuth: true } },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } }
  }
  // Force 2FA setup if logged in but not completed
  if (auth.isAuthenticated && auth.user?.twoFASetupRequired && to.name !== "twofa-setup") {
    return { name: "twofa-setup" }
  }
})

export default router