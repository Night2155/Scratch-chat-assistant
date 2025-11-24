// 顯示錯誤訊息
const params = new URLSearchParams(window.location.search);
if (params.get("error") === "1") {
  const box = document.getElementById("errorBox");
  box.classList.remove("hidden");
  history.replaceState(null, "", "/login.html");
  setTimeout(() => {
    box.classList.add("hidden");
  }, 3000);
}

// ✅ 根據身分選擇送出至對應 API
document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const form = e.target;
  const role = document.getElementById("roleSelect").value;

  if (role === "teacher") {
    form.action = "/teacher-login";
  } else {
    form.action = "/login";
  }

  form.submit();
});
