import { createRouter, createWebHistory } from "vue-router"
import DashboardPage from "@/pages/DashboardPage.vue"
import ProfilePage from "@/pages/ProfilePage.vue"
import LoginPage from "@/pages/LoginPage.vue"
import RegisterPage from "@/pages/RegisterPage.vue"
import ForgotPage from "@/pages/ForgotPage.vue"
import ResetPage from "@/pages/ResetPage.vue"
import TwoFASetupPage from "@/pages/TwoFASetupPage.vue"
import { useAuthStore } from "@/stores/auth"

const PendingApprovalPage = () => import("@/pages/PendingApproval.vue") // lazy

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: LoginPage },
    { path: "/register", name: "register", component: RegisterPage },
    { path: "/forgot", name: "forgot", component: ForgotPage },
    { path: "/reset", name: "reset", component: ResetPage },
    { path: "/twofa-setup", name: "twofa-setup", component: TwoFASetupPage },
    { path: "/pending-approval", name: "pending-approval", component: PendingApprovalPage,},
    { path: "/", redirect: "/dashboard" },
    { path: "/dashboard", name: "dashboard", component: DashboardPage, meta: { requiresAuth: true } },
    { path: "/profile", name: "profile", component: ProfilePage, meta: { requiresAuth: true } },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  // 1) Auth-only routes
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } }
  }

  // 2) If 2FA is ALREADY enabled, do not allow lingering on setup page
  if (
    auth.isAuthenticated &&
    to.name === "twofa-setup" &&
    auth.user?.twoFAEnabled === true &&
    auth.user?.twoFASetupRequired === false
  ) {
    return { name: "dashboard" }
  }

  // 3) Mandatory 2FA setup first (forces user into setup page)
  if (
    auth.isAuthenticated &&
    auth.user?.twoFASetupRequired === true &&
    to.name !== "twofa-setup"
  ) {
    return { name: "twofa-setup" }
  }

  // 4) Unified inspection gate: block everything until approved
  //    (Allow a short bypass list so user can see profile/twofa/pending)
  const bypass = new Set(["twofa-setup", "pending-approval", "profile"])
  if (
    auth.isAuthenticated &&
    auth.user &&
    auth.user.approved === false &&
    !bypass.has(to.name)
  ) {
    return { name: "pending-approval" }
  }
})

export default router