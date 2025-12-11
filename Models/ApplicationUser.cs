using Microsoft.AspNetCore.Identity;

public class ApplicationUser : IdentityUser
{
    // ラーメンの投稿などで表示するユーザーネーム
    public string? DisplayName { get; set; } 
}