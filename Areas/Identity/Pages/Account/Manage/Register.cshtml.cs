using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.ComponentModel.DataAnnotations;
using System.Text;
using System.Threading.Tasks;
using NoodleMaps.Models;
using System.ComponentModel.DataAnnotations;

namespace NoodleMaps.Areas.Identity.Pages.Account
{
    // クラス名は RegisterModel
    public class RegisterModel : PageModel
    {
        private readonly SigInManager<ApplicationUser> _signInManager;
        private readonly UserManager<ApplicationUser> _userManager;

        private readonly ILogger<RegisterModel> _logger;

        public RegisterModel(
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager,
            ILogger<RegisterModel> logger)
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _logger = logger;
        }

        [BindProperty]
        public InputModel Input { get; set; } = new InputModel();

        public string? ReturnUrl { get; set; }

        public class InputModel
        {
            [Required(ErrorMessage = "メールアドレスは必須です。")]
            [EmailAddress]
            [Display(Name = "メールアドレス")]
            public string? Email { get; set; }

            [Required(ErrorMessage = "パスワードは必須です。")]
            [StringLength(100, ErrorMessage = "{0}は少なくとも{2}文字、最大{1}文字ではなければなりません。", MinimumLength = 6)]
            [DataType(DataType.Password)]
            [Display(Name = "パスワード")]
            public string? Password { get; set; }

            [DataType(DataType.Password)]
            [Display(Name = "パスワード確認")]
            [Compare("Password",ErrorMessage = "パスワードと確認パスワードが一致しませんでした。")]
            public string? ConfirmPassword { get; set; }
        }

        public void OnGet(string? ReturnUrl = null )
        {
            ReturnUrl = ReturnUrl;
        }
    }

}