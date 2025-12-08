using NoodleMaps.Data; //作成したDbContextを参照
using Microsoft.EntityFrameworkCore; //EF Coreの名前空間

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();

// DbContextをサービスとして登録し、SQLiteを使用するように設定
builder.Services.AddDbContext<NoodleDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("NoodleMapsContext")));

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
