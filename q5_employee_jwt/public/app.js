let token = localStorage.getItem('token');

$(document).ready(function() {
    if (token) {
        showDashboard();
    }

    $('#loginForm').submit(function(e) {
        e.preventDefault();
        login();
    });

    $('#leaveForm').submit(function(e) {
        e.preventDefault();
        applyLeave();
    });
});

function login() {
    const empId = $('#empId').val();
    const password = $('#password').val();

    $.ajax({
        url: '/api/login',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ empId, password }),
        success: function(response) {
            token = response.token;
            localStorage.setItem('token', token);
            localStorage.setItem('employee', JSON.stringify(response.employee));
            showDashboard();
        },
        error: function() {
            alert('Invalid credentials');
        }
    });
}

function showDashboard() {
    $('#loginSection').hide();
    $('#dashboardSection').show();
    loadProfile();
    loadLeaveHistory();
}

function loadProfile() {
    const employee = JSON.parse(localStorage.getItem('employee'));
    $('#profileData').html(`
        <table class="table">
            <tr><th>Employee ID</th><td>${employee.empId}</td></tr>
            <tr><th>Name</th><td>${employee.name}</td></tr>
            <tr><th>Email</th><td>${employee.email}</td></tr>
            <tr><th>Position</th><td>${employee.position}</td></tr>
        </table>
    `);
}

function applyLeave() {
    const date = $('#leaveDate').val();
    const reason = $('#leaveReason').val();

    $.ajax({
        url: '/api/leave',
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        contentType: 'application/json',
        data: JSON.stringify({ date, reason }),
        success: function() {
            alert('Leave application submitted');
            $('#leaveForm')[0].reset();
            loadLeaveHistory();
        }
    });
}

function loadLeaveHistory() {
    $.ajax({
        url: '/api/leaves',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
        success: function(leaves) {
            let html = '<table class="table"><thead><tr><th>Date</th><th>Reason</th><th>Status</th></tr></thead><tbody>';
            leaves.forEach(leave => {
                html += `<tr>
                    <td>${new Date(leave.date).toLocaleDateString()}</td>
                    <td>${leave.reason}</td>
                    <td>${leave.granted ? 'Granted' : 'Pending'}</td>
                </tr>`;
            });
            html += '</tbody></table>';
            $('#leaveHistory').html(html);
        }
    });
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('employee');
    token = null;
    $('#dashboardSection').hide();
    $('#loginSection').show();
}