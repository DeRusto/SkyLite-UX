export default defineNuxtRouteMiddleware((to) => {
  const { currentUser } = useUsers();

  const publicRoutes = ["/login", "/settings", "/screensaver"];

  // If user is not logged in and not on a public page, redirect to login
  if (!currentUser.value && !publicRoutes.includes(to.path)) {
    return navigateTo("/login");
  }

  // If user is logged in and tries to access login page, redirect to home
  if (currentUser.value && to.path === "/login") {
    return navigateTo("/");
  }
});
