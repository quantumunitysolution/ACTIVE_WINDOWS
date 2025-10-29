#define _WIN32_WINNT 0x0600
#include <windows.h>
#include <psapi.h>
#include <tchar.h>
#include <iostream>
#include <string>

#pragma comment(lib, "psapi.lib")

// Forward-declare for MinGW if not defined
#ifndef QueryFullProcessImageNameW
extern "C" BOOL WINAPI QueryFullProcessImageNameW(HANDLE hProcess, DWORD dwFlags, LPWSTR lpExeName, PDWORD lpdwSize);
#endif

std::string WideToUtf8(const std::wstring &w)
{
    if (w.empty())
        return {};
    int size_needed = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), NULL, 0, NULL, NULL);
    std::string strTo(size_needed, 0);
    WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), &strTo[0], size_needed, NULL, NULL);
    return strTo;
}

std::string GetProcessName(DWORD processID)
{
    std::wstring procName = L"<unknown>";
    HANDLE hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, processID);
    if (hProcess)
    {
        wchar_t path[MAX_PATH];
        DWORD size = MAX_PATH;
        if (QueryFullProcessImageNameW(hProcess, 0, path, &size))
        {
            std::wstring full(path);
            size_t pos = full.find_last_of(L"\\/");
            if (pos != std::wstring::npos)
                procName = full.substr(pos + 1);
            else
                procName = full;
        }
        CloseHandle(hProcess);
    }
    return WideToUtf8(procName);
}

std::string GetProcessPath(DWORD processID)
{
    std::wstring path = L"<unknown>";
    HANDLE hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, processID);
    if (hProcess)
    {
        wchar_t szPath[MAX_PATH];
        DWORD size = MAX_PATH;
        if (QueryFullProcessImageNameW(hProcess, 0, szPath, &size))
        {
            path = szPath;
        }
        CloseHandle(hProcess);
    }
    return WideToUtf8(path);
}

std::string GetWindowTitle(HWND hwnd)
{
    int len = GetWindowTextLengthW(hwnd);
    if (len == 0)
        return "";
    std::wstring wtitle(len + 1, L'\0');
    GetWindowTextW(hwnd, &wtitle[0], len + 1);
    size_t pos = wtitle.find(L'\0');
    if (pos != std::wstring::npos)
        wtitle.resize(pos);
    return WideToUtf8(wtitle);
}

int main()
{
    HWND hwnd = GetForegroundWindow();
    if (!hwnd)
    {
        std::cout << "{\"pid\":0,\"processName\":\"\",\"title\":\"\",\"path\":\"\"}\n";
        return 0;
    }

    DWORD pid = 0;
    GetWindowThreadProcessId(hwnd, &pid);

    std::string processName = GetProcessName(pid);
    std::string processPath = GetProcessPath(pid);
    std::string title = GetWindowTitle(hwnd);

    // Output JSON as array
    std::cout << "[";
    std::cout << pid << ",";

    // processName
    std::cout << "\"";
    for (char c : processName)
    {
        if (c == '\\')
            std::cout << "\\\\";
        else if (c == '"')
            std::cout << "\\\"";
        else
            std::cout << c;
    }
    std::cout << "\",";

    // processPath
    std::cout << "\"";
    for (char c : processPath)
    {
        if (c == '\\')
            std::cout << "\\\\";
        else if (c == '"')
            std::cout << "\\\"";
        else
            std::cout << c;
    }
    std::cout << "\",";

    // title
    std::cout << "\"";
    for (char c : title)
    {
        if (c == '\\')
            std::cout << "\\\\";
        else if (c == '"')
            std::cout << "\\\"";
        else
            std::cout << c;
    }
    std::cout << "\"";

    std::cout << "]";
    return 0;
}
