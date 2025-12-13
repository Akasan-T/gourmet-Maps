using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using NoodleMaps.Models;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;

namespace NoodleMaps.Areas.Identity.Pages.Account.Manage
{
    public class SetProfileModel : PageModel
    {
        private readonly UserManager<ApplicationUser> _userManager;

        public SetProfileModel(UserManager<ApplicationUser> userManager)
        {
            _userManager = userManager;
        }

        [BindProperty]
        public InputModel Input { get; set; } = new InputModel();

        [TempData]
        public string StatusMessage { get; set; } = "";

        public class InputModel
        {
            [PersonalData]
            [Display(Name = "表示名(ユーザー名として使用)")]
            public string? DisplayName{ get; set; }
        }

        private void Load(ApplicationUser user)
        {
            Input.DisplayName = user.DisplayName;
        }

        public async Task<IActionResult> OnGetAsync()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return NotFound($"Unable to load user with ID '{_userManager.GetUserId(User)}'");
            }

            if (!ModelState.IsValid)
            {
                Load(user);
                return Page();
            }

            // DisplayNameを更新
            user.DisplayName = Input.DisplayName;
            await _userManager.UpdateAsync(user);

            StatusMessage = "あなたの表示名が更新されました";
            return RedirectToPage();
        }
    }
}