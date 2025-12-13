using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using NoodleMaps.Models;
using System.Runtime.InteropServices;
using System.Reflection.Metadata; // ApplicationUser があれば必須

namespace NoodleMaps.Areas.Identity.Pages.Account
{
    // クラス名 LoginModel, IdentityPageModelを継承
    public class LoginModel : PageModel
    {
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly ILogger<LoginModel> _logger;

        public LoginModel(SignInManager<ApplicationUser> signInManager, ILogger<LoginModel> logger)
        {
            _signInManager = signInManager;
            _logger = logger;
        }

        [BindProperty]
        public InputModel Input { get; set; } = new InputModel();

        public string? ReturnUrl { get; set; }

        [TempData]
        public string? ErrorMessage { get; set; }

        public class InputModel
        {
            [Required(ErrorMessage = "メールアドレスは必須です。")]
            [EmailAddress]
            public string? Email { get; set; }

            [Required(ErrorMessage = "パスワードは必須です。")]
            [DataType(DataType.Password)]
            public string? Password { get; set; }

            [Display(Name = "私を記憶する")]
            public bool RememberMe { get; set; }
        }

        public async Task OnGetAsync(string? ReturnUrl = null)
        {
            if (!string.IsNullOrEmpty (ErrorMessage))
            {
                modelState.AddModelError(string.Empty, ErrorMessage);
            }

            ReturnUrl ??= Url.Content("~/");

            // Clear the existing external cookie to ensure a clean login process
            await HttpContent.SignOutAsync(IdentityConstants.ExternalScheme);

            ReturnUrl = ReturnUrl;
        }

        public async Task<IActionResult> OnPostAsync(string? ReturnUrl = null)
        {
            ReturnUrl ??= Url.Content("~/");

            if (ModelState.IsValid)
            {
                // Sign in logic
                var result = await _signInManager.PasswordSignInAsync(Input.Email!, Input.Password!, Input.RememberMe, lockoutOnFailure: false);

                if (result.Succeeded)
                {
                    _logger.LogInformation("User logged in.");
                    return LocalRedirect(ReturnUrl);
                }

                // 他のエラー処理(ロックアウト、2FAなど)は省略
                else
                {
                    ModelState.AddModelError(string.Empty, "ログイン試行が無効です。");
                    return Pages();
                }
            }

            // if We got this far, something failed, redisplay form
            return Pages();
        }
    }
}