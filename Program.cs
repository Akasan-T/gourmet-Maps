using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using NoodleMaps.Data; 

var builder = WebApplication.CreateBuilder(args);

//SQLiteの接続文字列
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Data Source=noodlemaps.db";

builder.Services.AddDbContext<NoodleDbContext>(options =>
    options.UseSqlite(connectionString));

// DbContextをサービスとして登録し、SQLiteを使用するように設定
builder.Services
    .AddDefaultIdentity<IdentityUser>(options => options.SignIn.RequireConfirmedAccount = true)
    .AddEntityFrameworkStores<NoodleDbContext>();

// Add services to the container.
builder.Services.AddRazorPages();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseRouting();

app.UseAuthorization();

app.MapStaticAssets();
app.MapRazorPages()
   .WithStaticAssets();

app.Run();
