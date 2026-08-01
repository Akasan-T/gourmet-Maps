FROM node:20-alpine AS frontend-build
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src
COPY backend/*.csproj ./backend/
RUN dotnet restore backend/NoodleMaps.csproj
COPY backend/ ./backend/
COPY --from=frontend-build /src/frontend/dist ./frontend/dist
RUN mkdir -p /app/publish/wwwroot && cp -R /src/frontend/dist/* /app/publish/wwwroot/ || true
RUN dotnet publish backend/NoodleMaps.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=backend-build /app/publish .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
CMD ["dotnet", "NoodleMaps.dll"]
