using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace GourmetMaps.Services
{
    // 未処理例外を /api 配下に限り JSON (ProblemDetails) で返すハンドラ。
    // これがないと、非 Development では Razor の /Error ページ (HTML) が返ってしまい、
    // JSON を期待する SPA クライアントがパースに失敗する。
    // /api 以外 (Identity UI などの Razor ページ) は false を返して既定の /Error 処理に委ねる。
    public sealed class ApiExceptionHandler : IExceptionHandler
    {
        private readonly IProblemDetailsService _problemDetailsService;
        private readonly IHostEnvironment _environment;
        private readonly ILogger<ApiExceptionHandler> _logger;

        public ApiExceptionHandler(
            IProblemDetailsService problemDetailsService,
            IHostEnvironment environment,
            ILogger<ApiExceptionHandler> logger)
        {
            _problemDetailsService = problemDetailsService;
            _environment = environment;
            _logger = logger;
        }

        public async ValueTask<bool> TryHandleAsync(
            HttpContext httpContext,
            Exception exception,
            CancellationToken cancellationToken)
        {
            if (!httpContext.Request.Path.StartsWithSegments("/api"))
            {
                return false;
            }

            _logger.LogError(
                exception,
                "未処理の例外: {Method} {Path}",
                httpContext.Request.Method,
                httpContext.Request.Path);

            httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;

            return await _problemDetailsService.TryWriteAsync(new ProblemDetailsContext
            {
                HttpContext = httpContext,
                Exception = exception,
                ProblemDetails = new ProblemDetails
                {
                    Status = StatusCodes.Status500InternalServerError,
                    Title = "サーバーでエラーが発生しました。時間をおいて再度お試しください。",
                    // 本番では例外の詳細を露出しない。開発時のみデバッグ用に含める。
                    Detail = _environment.IsDevelopment() ? exception.ToString() : null,
                },
            });
        }
    }
}
